# -*- coding: utf-8 -*-
"""COM 稳定调用工具：忙重试装饰器 + AutoCAD 早期绑定连接。

用法：
    from com_retry import com_retry, connect_acad

    acad = connect_acad()                     # AutoCAD.Application.25.1 早期绑定
    doc = acad.ActiveDocument

    @com_retry()                              # 任何 COM 调用点都建议套上
    def add_circle(x, y, r):
        return doc.ModelSpace.AddCircle(APoint(x, y), r)

注意：
- 动态绑定下 ent.Layer = x 这类属性赋值会报 "Property can not be set"，
  必须用 connect_acad() 里的 gencache.EnsureDispatch 早期绑定。
- 零依赖设计：不连接 AutoCAD 时本模块可安全 import（win32com 懒加载）。
"""

import functools
import time

# 已知"对方忙，稍后重试"类 HRESULT
RPC_E_CALL_REJECTED = -2147418111        # 呼叫被呼叫方拒绝（AutoCAD 界面忙时最常见）
RPC_E_SERVERCALL_RETRYLATER = -2147417846
RETRYABLE_HRESULTS = {RPC_E_CALL_REJECTED, RPC_E_SERVERCALL_RETRYLATER}


def _hresult_of(exc):
    """从 pythoncom 的 com_error 或任意异常里抠出 HRESULT。"""
    hr = getattr(exc, "hresult", None)
    if hr is None and exc.args:
        hr = exc.args[0]
    return hr


def com_retry(times=60, interval=0.25):
    """装饰器：被装饰函数遇到'呼叫被拒'类 com_error 时自动重试。

    times 次重试仍失败则抛出最后一次异常；其他 HRESULT 立即原样抛出，
    避免把真 bug（参数错、对象没了）伪装成超时。
    """
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            last = None
            for _ in range(times):
                try:
                    return fn(*args, **kwargs)
                except Exception as exc:
                    if _hresult_of(exc) in RETRYABLE_HRESULTS:
                        last = exc
                        time.sleep(interval)
                        continue
                    raise
            raise last
        return wrapper
    return deco


def connect_acad(progid="AutoCAD.Application.25.1"):
    """早期绑定连接（或启动）AutoCAD，返回 Application 对象。

    - 用 gencache.EnsureDispatch 而不是 Dispatch：动态绑定下
      ent.Layer = x 会报 "Property can not be set"，早期绑定才可写属性。
    - 升级 AutoCAD 后若出现诡异类型错误，先清 %TEMP%\\gen_py 再连。
    - 连不上最常见原因：AutoCAD 未安装/未启动过（COM 未注册）、
      装的是 LT 版、ProgID 版本号不对。
    """
    import win32com.client  # 懒加载，保证本模块可零依赖 import

    try:
        return win32com.client.gencache.EnsureDispatch(progid)
    except Exception as exc:
        raise RuntimeError(
            "连接 %s 失败: %r\n"
            "排查顺序: 1) AutoCAD 是否安装且启动过一次; 2) ProgID 版本号是否匹配"
            "(2026=25.1, 可用 GetObject族/注册表确认); 3) %TEMP%\\gen_py 缓存是否过期"
            % (progid, exc)
        )


def reset_cecolor(doc):
    """把当前实体颜色归为 ByLayer，防止新实体继承用户会话残留的 CECOLOR。"""
    doc.SetVariable("CECOLOR", "256")
