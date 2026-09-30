#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
ll r[30];
int n;
string s;
ll encode(int n,int pos){
    if(n==0) return 0;
    int p=pos,d=0,q=-1,e=-1;//p='(',q='|',e=')'
    for(int i=p+1;i<(int)s.size();i++){
        if(s[i]=='(') d++;
        else if(s[i]==')'){
            if(d==0){
                e=i;
                break;
            }
            d--;
        }
        else if(d==0&&q==-1) q=i;
    }
    int u0=(q-p-1)/3,v0=(e-q-1)/3,w0=n-1-u0-v0;
    ll rk=0;
    for(int u=0;u<=n-1;u++){
        for(int v=0;u+v<=n-1;v++){
            int w=n-1-u-v;
            if(u==u0&&v==v0){
                ll p1=encode(u,p+1);
                ll p2=encode(v,q+1);
                ll p3=encode(w,e+1);
                rk+=(p1*r[v]+p2)*r[w]+p3;
                return rk;
            }
            rk+=r[u]*r[v]*r[w];
        }
    }
    return rk;
}
string decode(int n,ll code){
    if(n==0) return string();
    for(int u=0;u<=n-1;u++){
        for(int v=0;u+v<=n-1;v++){
            int w=n-1-u-v;
            ll cur=r[u]*r[v]*r[w];
            if(code>=cur) {
                code-=cur;
                continue;
            }
            ll p3=code%r[w];code/=r[w];
            ll p2=code%r[v];code/=r[v];
            ll p1=code;
            return "("+decode(u,p1)+"|"+decode(v,p2)+")"+decode(w,p3);
        }
    }
    return string();
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    r[0]=1;
    for(int n=1;n<=25;n++){
        for(int u=0;u<=n-1;u++){
            for(int v=0;u+v<=n-1;v++){
                r[n]+=r[u]*r[v]*r[n-1-u-v];
            }
        }
    }
    string op;cin>>op;
    int T;cin>>T;
    while(T--){
        if(op=="encode"){
            cin>>n>>s;
            cout<<encode(n,0)<<endl;
        }
        else{
            ll x;
            cin>>n>>x;
            cout<<decode(n,x)<<endl;
        }
    }
    return 0;
}